import json
import unittest
from pathlib import Path


class CatalystDeploymentSyncTests(unittest.TestCase):
    def test_active_catalyst_python_sources_match_server(self) -> None:
        repository_root = Path(__file__).resolve().parents[2]
        server_app = repository_root / "SERVER" / "app"
        catalyst_app = repository_root / "catalyst-build" / "app"

        server_sources = {
            path.relative_to(server_app).as_posix(): path.read_bytes()
            for path in server_app.rglob("*.py")
            if "__pycache__" not in path.parts
        }
        catalyst_sources = {
            path.relative_to(catalyst_app).as_posix(): path.read_bytes()
            for path in catalyst_app.rglob("*.py")
            if "__pycache__" not in path.parts
            and path.relative_to(catalyst_app).parts[0] != "app"
        }

        self.assertEqual(catalyst_sources, server_sources)

    def test_appsail_prepares_dependencies_before_startup(self) -> None:
        repository_root = Path(__file__).resolve().parents[2]
        server_requirements = repository_root / "SERVER" / "requirements.txt"
        catalyst_requirements = (
            repository_root / "catalyst-build" / "requirements.txt"
        )
        self.assertEqual(
            catalyst_requirements.read_text(encoding="utf-8"),
            server_requirements.read_text(encoding="utf-8"),
        )

        app_config_path = repository_root / "catalyst-build" / "app-config.json"
        app_config = json.loads(app_config_path.read_text(encoding="utf-8"))
        self.assertEqual(app_config["command"], "python3 run.py")
        self.assertIn("X_ZOHO_CATALYST_LISTEN_PORT", (
            repository_root / "catalyst-build" / "run.py"
        ).read_text(encoding="utf-8"))

        scripts = app_config["scripts"]
        self.assertIn("requirements.txt", scripts["predeploy"])
        self.assertIn("-t ./", scripts["predeploy"])
        self.assertIn("--platform manylinux2014_x86_64", scripts["predeploy"])
        self.assertIn("--python-version 3.13", scripts["predeploy"])
        self.assertIn("--only-binary=:all:", scripts["predeploy"])
        self.assertNotIn("preserve", scripts)
        self.assertNotIn("pip install", app_config["command"])
        self.assertNotIn("vendor", scripts["predeploy"])

        requirements = {
            line.split("==", 1)[0].split("[", 1)[0].lower()
            for line in server_requirements.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        }
        self.assertIn("httpx", requirements)
        ignore_file = repository_root / "catalyst-build" / ".catalystignore"
        self.assertIn(
            "vendor/**",
            ignore_file.read_text(encoding="utf-8").splitlines(),
        )
