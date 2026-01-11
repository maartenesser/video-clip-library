"""R2 client for reading and writing files to Cloudflare R2 storage."""

import os
from pathlib import Path
from typing import Optional

import aioboto3
import structlog
from botocore.config import Config
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger(__name__)


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


# Singleton instance
_r2_client: Optional[R2Client] = None


def get_r2_client() -> R2Client:
    """Get or create the R2 client singleton."""
    global _r2_client
    if _r2_client is None:
        _r2_client = R2Client()
    return _r2_client
