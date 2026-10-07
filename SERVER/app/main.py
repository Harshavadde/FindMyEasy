import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes.listings import router as listings_router

from app.core.config import settings
from app.db.database import Base, engine
from app.models.listing_image import ListingImage
from app.api.routes.images import router as images_router
from app.api.routes.public_listings import router as public_listings_router


# ---------------------------------------------------------------------------
# Create upload directory
# ---------------------------------------------------------------------------

os.makedirs(
    settings.UPLOAD_DIR,
    exist_ok=True,
)


# ---------------------------------------------------------------------------
# Create database tables
# ---------------------------------------------------------------------------

Base.metadata.create_all(
    bind=engine,
)


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="FindMyEasy API",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Static uploaded files
# ---------------------------------------------------------------------------

app.mount(
    "/uploads",
    StaticFiles(directory=settings.UPLOAD_DIR),
    name="uploads",
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(
    images_router,
)


app.include_router(
    listings_router,
)

app.include_router(public_listings_router)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "FindMyEasy API is running",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }