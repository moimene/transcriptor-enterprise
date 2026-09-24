import logging
import os
import uuid
from typing import Any, Dict, Optional
import boto3
from botocore.config import Config
from config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self.bucket = settings.R2_BUCKET_NAME
        self.endpoint_url = settings.R2_ENDPOINT_URL or None
        self.access_key = settings.R2_ACCESS_KEY_ID or None
        self.secret_key = settings.R2_SECRET_ACCESS_KEY or None
        self.region = settings.R2_REGION

        if self.access_key and self.secret_key:
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
                config=Config(signature_version="s3v4")
            )
        else:
            self.s3_client = None

    def is_configured(self) -> bool:
        return self.s3_client is not None

    def generate_presigned_upload_url(
        self,
        filename: str,
        content_type: str = "application/octet-stream"
    ) -> Dict[str, Any]:
        """
        Generates a Presigned PUT URL allowing the browser to upload up to 1GB directly
        to Cloudflare R2 / S3 without touching Vercel or saturating Railway backend.
        """
        if not self.s3_client:
            raise ValueError("Cloudflare R2 / S3 Storage credentials are not configured.")

        # Generate a unique key with a timestamp prefix
        ext = os.path.splitext(filename)[1]
        unique_id = str(uuid.uuid4())
        object_key = f"uploads/{unique_id}{ext}"

        presigned_url = self.s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self.bucket,
                "Key": object_key,
                "ContentType": content_type
            },
            ExpiresIn=settings.PRESIGNED_EXPIRATION_SECONDS
        )

        return {
            "upload_url": presigned_url,
            "object_key": object_key,
            "filename": filename,
            "expires_in": settings.PRESIGNED_EXPIRATION_SECONDS
        }

    def download_file(self, object_key: str, local_destination_path: str) -> str:
        """Downloads an object from storage to a local path for processing."""
        if not self.s3_client:
            raise ValueError("Storage client not configured.")

        os.makedirs(os.path.dirname(local_destination_path), exist_ok=True)
        self.s3_client.download_file(self.bucket, object_key, local_destination_path)
        return local_destination_path

    def delete_file(self, object_key: str) -> bool:
        """Deletes an object immediately to enforce Zero Data Retention."""
        if not self.s3_client:
            return False
        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=object_key)
            return True
        except Exception as e:
            logger.warning(f"Error eliminando objeto {object_key}: {e}")
            return False
