import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

console.log('Config:', { accountId, bucketName, hasAccessKey: !!accessKeyId, hasSecret: !!secretAccessKey });

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const corsConfig = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: ['http://localhost:3000', 'http://localhost:3001', '*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ],
};

try {
  await client.send(new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: corsConfig,
  }));
  console.log('CORS configuration applied successfully!');
} catch (error) {
  console.error('Failed to apply CORS:', error.message);
  process.exit(1);
}
