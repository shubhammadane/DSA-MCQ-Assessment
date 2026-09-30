import os
import sys

_backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dsa-mcq-platform", "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_backend_app_dir = os.path.join(_backend_dir, "app")
if _backend_app_dir not in __path__:
    __path__.append(_backend_app_dir)
