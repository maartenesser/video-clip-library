"""R2 client for reading and writing files to Cloudflare R2 storage.

This module provides async operations for:
- File upload/download (with retry logic)
- Streaming uploads for large files
- Multipart upload for files >5MB
- Presigned URL generation
"""

import asyncio
import os
from pathlib import Path
from typing import Optional

import aioboto3
import structlog
from botocore.config import Config
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger(__name__)

# Multipart upload threshold (5MB)
MULTIPART_THRESHOLD = 5 * 1024 * 1024
# Multipart chunk size (10MB)
MULTIPART_CHUNK_SIZE = 10 * 1024 * 1024


class R2Client:
    """Async client for Cloudflare R2 storage operations."""

    def __init__(
        self,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ):
        """Initialize R2 client with credentials.

        Args:
            access_key_id: R2 access key ID (or from env R2_ACCESS_KEY_ID)
            secret_access_key: R2 secret access key (or from env R2_SECRET_ACCESS_KEY)
            endpoint_url: R2 endpoint URL (or from env R2_ENDPOINT_URL)
            bucket_name: Default bucket name (or from env R2_BUCKET_NAME)
        """
        self.access_key_id = access_key_id or os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = secret_access_key or os.getenv("R2_SECRET_ACCESS_KEY")
        self.endpoint_url = endpoint_url or os.getenv("R2_ENDPOINT_URL")
        self.bucket_name = bucket_name or os.getenv("R2_BUCKET_NAME", "video-clips")

        if not all([self.access_key_id, self.secret_access_key, self.endpoint_url]):
            logger.warning("R2 credentials not fully configured")

        self.session = aioboto3.Session()
        self.config = Config(
            retries={"max_attempts": 3, "mode": "adaptive"},
            connect_timeout=30,
            read_timeout=300,  # 5 minutes for large files
        )

    def _get_client_context(self):
        """Get async context manager for S3 client."""
        return self.session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            config=self.config,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def download_file(
        self,
        key: str,
        local_path: str,
        bucket: Optional[str] = None,
    ) -> str:
        """Download a file from R2 to local path.

        Args:
            key: Object key in R2
            local_path: Local path to save the file
            bucket: Bucket name (uses default if not provided)

        Returns:
            Local path of downloaded file
        """
        bucket = bucket or self.bucket_name
        local_path = Path(local_path)
        local_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info("Downloading file from R2", key=key, bucket=bucket, local_path=str(local_path))

        async with self._get_client_context() as client:
            await client.download_file(bucket, key, str(local_path))

        logger.info("File downloaded successfully", key=key, size=local_path.stat().st_size)
        return str(local_path)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def upload_file(
        self,
        local_path: str,
        key: str,
        bucket: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> str:
        """Upload a file to R2.

        Args:
            local_path: Local path of file to upload
            key: Object key in R2
            bucket: Bucket name (uses default if not provided)
            content_type: MIME type of the file

        Returns:
            R2 URL of uploaded file
        """
        bucket = bucket or self.bucket_name
        local_path = Path(local_path)

        if not local_path.exists():
            raise FileNotFoundError(f"File not found: {local_path}")

        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        else:
            # Auto-detect content type
            suffix = local_path.suffix.lower()
            content_types = {
                ".mp4": "video/mp4",
                ".webm": "video/webm",
                ".mov": "video/quicktime",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
            }
            if suffix in content_types:
                extra_args["ContentType"] = content_types[suffix]

        logger.info(
            "Uploading file to R2",
            key=key,
            bucket=bucket,
            size=local_path.stat().st_size,
        )

        async with self._get_client_context() as client:
            await client.upload_file(
                str(local_path),
                bucket,
                key,
                ExtraArgs=extra_args if extra_args else None,
            )

        url = f"{self.endpoint_url}/{bucket}/{key}"
        logger.info("File uploaded successfully", key=key, url=url)
        return url

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def get_presigned_url(
        self,
        key: str,
        bucket: Optional[str] = None,
        expires_in: int = 3600,
    ) -> str:
        """Generate a presigned URL for accessing an object.

        Args:
            key: Object key in R2
            bucket: Bucket name (uses default if not provided)
            expires_in: URL expiration time in seconds

        Returns:
            Presigned URL
        """
        bucket = bucket or self.bucket_name

        async with self._get_client_context() as client:
            url = await client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )

        return url

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def delete_file(
        self,
        key: str,
        bucket: Optional[str] = None,
    ) -> None:
        """Delete a file from R2.

        Args:
            key: Object key in R2
            bucket: Bucket name (uses default if not provided)
        """
        bucket = bucket or self.bucket_name

        logger.info("Deleting file from R2", key=key, bucket=bucket)

        async with self._get_client_context() as client:
            await client.delete_object(Bucket=bucket, Key=key)

        logger.info("File deleted successfully", key=key)

    async def list_files(
        self,
        prefix: str = "",
        bucket: Optional[str] = None,
        max_keys: int = 1000,
    ) -> list[dict]:
        """List files in R2 bucket.

        Args:
            prefix: Filter by key prefix
            bucket: Bucket name (uses default if not provided)
            max_keys: Maximum number of keys to return

        Returns:
            List of file metadata dictionaries
        """
        bucket = bucket or self.bucket_name
        files = []

        async with self._get_client_context() as client:
            paginator = client.get_paginator("list_objects_v2")
            async for page in paginator.paginate(
                Bucket=bucket,
                Prefix=prefix,
                PaginationConfig={"MaxItems": max_keys},
            ):
                for obj in page.get("Contents", []):
                    files.append(
                        {
                            "key": obj["Key"],
                            "size": obj["Size"],
                            "last_modified": obj["LastModified"],
                            "etag": obj["ETag"],
                        }
                    )

        return files

    async def file_exists(
        self,
        key: str,
        bucket: Optional[str] = None,
    ) -> bool:
        """Check if a file exists in R2.

        Args:
            key: Object key in R2
            bucket: Bucket name (uses default if not provided)

        Returns:
            True if file exists, False otherwise
        """
        bucket = bucket or self.bucket_name

        try:
            async with self._get_client_context() as client:
                await client.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    async def upload_file_streaming(
        self,
        local_path: str,
        key: str,
        bucket: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> str:
        """Upload file to R2 with streaming - never loads entire file to memory.

        Uses multipart upload for files >5MB for better reliability and
        memory efficiency with large files.

        Args:
            local_path: Local path of file to upload
            key: Object key in R2
            bucket: Bucket name (uses default if not provided)
            content_type: MIME type of the file

        Returns:
            R2 key of uploaded file
        """
        bucket = bucket or self.bucket_name
        local_path = Path(local_path)

        if not local_path.exists():
            raise FileNotFoundError(f"File not found: {local_path}")

        file_size = local_path.stat().st_size

        # Auto-detect content type if not provided
        if not content_type:
            suffix = local_path.suffix.lower()
            content_types = {
                ".mp4": "video/mp4",
                ".webm": "video/webm",
                ".mov": "video/quicktime",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".mp3": "audio/mpeg",
            }
            content_type = content_types.get(suffix, "application/octet-stream")

        # Use multipart for large files (>5MB)
        if file_size > MULTIPART_THRESHOLD:
            logger.info(
                "Using multipart upload for large file",
                key=key,
                size_mb=round(file_size / (1024 * 1024), 2),
            )
            return await self._multipart_upload(
                local_path, key, bucket, content_type, file_size
            )

        # Simple upload for small files
        logger.info(
            "Uploading file to R2",
            key=key,
            size=file_size,
        )

        extra_args = {"ContentType": content_type} if content_type else {}

        async with self._get_client_context() as client:
            await client.upload_file(
                str(local_path),
                bucket,
                key,
                ExtraArgs=extra_args if extra_args else None,
            )

        logger.info("File uploaded successfully", key=key)
        return key

    async def _multipart_upload(
        self,
        local_path: Path,
        key: str,
        bucket: str,
        content_type: str,
        file_size: int,
    ) -> str:
        """Perform multipart upload for large files.

        Splits file into chunks and uploads them in parallel for
        better performance with large files.

        Args:
            local_path: Local path of file to upload
            key: Object key in R2
            bucket: Bucket name
            content_type: MIME type of the file
            file_size: Total file size in bytes

        Returns:
            R2 key of uploaded file
        """
        async with self._get_client_context() as client:
            # Initiate multipart upload
            response = await client.create_multipart_upload(
                Bucket=bucket,
                Key=key,
                ContentType=content_type,
            )
            upload_id = response["UploadId"]

            try:
                parts = []
                part_number = 1

                with open(local_path, "rb") as f:
                    while True:
                        chunk = f.read(MULTIPART_CHUNK_SIZE)
                        if not chunk:
                            break

                        # Upload part
                        part_response = await client.upload_part(
                            Bucket=bucket,
                            Key=key,
                            UploadId=upload_id,
                            PartNumber=part_number,
                            Body=chunk,
                        )

                        parts.append({
                            "PartNumber": part_number,
                            "ETag": part_response["ETag"],
                        })

                        logger.debug(
                            "Uploaded part",
                            key=key,
                            part=part_number,
                            size=len(chunk),
                        )
                        part_number += 1

                # Complete multipart upload
                await client.complete_multipart_upload(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id,
                    MultipartUpload={"Parts": parts},
                )

                logger.info(
                    "Multipart upload completed",
                    key=key,
                    parts=len(parts),
                    size_mb=round(file_size / (1024 * 1024), 2),
                )
                return key

            except Exception as e:
                # Abort multipart upload on error
                logger.error("Multipart upload failed, aborting", key=key, error=str(e))
                await client.abort_multipart_upload(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id,
                )
                raise

    async def upload_files_parallel(
        self,
        files: list[tuple[str, str]],
        bucket: Optional[str] = None,
        max_concurrent: int = 5,
    ) -> list[str]:
        """Upload multiple files in parallel.

        Args:
            files: List of (local_path, key) tuples
            bucket: Bucket name (uses default if not provided)
            max_concurrent: Maximum concurrent uploads

        Returns:
            List of successfully uploaded keys
        """
        bucket = bucket or self.bucket_name
        semaphore = asyncio.Semaphore(max_concurrent)

        async def upload_with_semaphore(local_path: str, key: str) -> Optional[str]:
            async with semaphore:
                try:
                    return await self.upload_file_streaming(local_path, key, bucket)
                except Exception as e:
                    logger.error("Failed to upload file", key=key, error=str(e))
                    return None

        tasks = [upload_with_semaphore(local_path, key) for local_path, key in files]
        results = await asyncio.gather(*tasks)

        # Filter out failed uploads
        successful = [key for key in results if key is not None]
        logger.info(
            "Parallel upload completed",
            total=len(files),
            successful=len(successful),
            failed=len(files) - len(successful),
        )
        return successful


# Singleton instance
_r2_client: Optional[R2Client] = None


def get_r2_client() -> R2Client:
    """Get or create the R2 client singleton."""
    global _r2_client
    if _r2_client is None:
        _r2_client = R2Client()
    return _r2_client
