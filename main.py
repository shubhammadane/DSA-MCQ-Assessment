import sys
import os

# Ensure backend directory is in Python path for root deployments
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dsa-mcq-platform", "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

__all__ = ["app"]
