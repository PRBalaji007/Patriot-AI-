from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.health import router as health_router
from app.routers.predict import router as predict_router
from app.routers.reports import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup/shutdown lifecycle.
    """

    yield


is_production = (
    settings.app_env.lower() == "production"
)


app = FastAPI(
    title="PATRIOT AI Backend",

    description=(
        "AI-assisted civic issue classification "
        "and authenticated civic report submission service."
    ),

    version="2.0.0",

    lifespan=lifespan,

    docs_url=(
        None
        if is_production
        else "/docs"
    ),

    redoc_url=(
        None
        if is_production
        else "/redoc"
    ),

    openapi_url=(
        None
        if is_production
        else "/openapi.json"
    ),
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,

    allow_origins=settings.cors_origins,

    allow_credentials=True,

    allow_methods=[
        "GET",
        "POST",
        "OPTIONS",
    ],

    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
    ],
)


# ---------------------------------------------------------
# ROUTERS
# ---------------------------------------------------------

app.include_router(
    health_router,
    prefix="/api"
)

app.include_router(
    predict_router,
    prefix="/api"
)

app.include_router(
    reports_router
)


# ---------------------------------------------------------
# ROOT
# ---------------------------------------------------------

@app.get("/")
async def root():

    return {
        "name": "PATRIOT AI Backend",

        "version": app.version,

        "environment": settings.app_env,

        "status": "online",
    }