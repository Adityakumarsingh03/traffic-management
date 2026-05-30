"""
YOLOv8 Indian Road Vehicle Detection API
Serves detection results and auto-saves images for future fine-tuning.
"""

import sys
import os

# Ensure src/ is on the path when running from any working directory
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from detect import detect_from_bytes, load_model, save_detection_for_training, get_model_info

app = FastAPI(
    title="Jamshedpur Traffic AI - Vehicle Detection API",
    description="YOLOv8-based Indian road vehicle detection with PCU calculation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Pre-load the model at startup so the first request is fast."""
    load_model()
    print("Model pre-loaded and ready")


@app.get("/health")
async def health():
    info = get_model_info()
    return {
        "status": "ok",
        "model":  info.get("name", "YOLOv8n"),
        "source": info.get("source", "default"),
        "mAP":    info.get("mAP", "N/A"),
    }


@app.get("/model-info")
async def model_info_endpoint():
    return get_model_info()


@app.post("/detect")
async def detect_single(
    file: UploadFile = File(...),
    junction_id: str = Form(default="unknown"),
    direction: str = Form(default="unknown"),
    save_for_training: str = Form(default="true"),
):
    """
    Detect Indian road vehicles in an uploaded image.

    Returns counts, PCU totals, congestion level, and annotated JPEG.
    Optionally saves the image + YOLO labels to training_data/ for future
    fine-tuning on Jamshedpur-specific traffic patterns.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()

    if len(image_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large — max 15 MB")

    result = detect_from_bytes(image_bytes)

    should_save = save_for_training.lower() in ("true", "1", "yes")
    training_saved = False

    if should_save and result['total_vehicles'] > 0:
        try:
            save_detection_for_training(image_bytes, result, junction_id, direction)
            training_saved = True
        except Exception as e:
            print(f"Could not save training data: {e}")

    return JSONResponse({
        "success":              True,
        "counts":               result['counts'],
        "detections":           result['detections'],
        "total_vehicles":       result['total_vehicles'],
        "total_pcu":            result['total_pcu'],
        "density":              result['density'],
        "congestion_level":     result['congestion_level'],
        "annotated_image":      result['annotated_image'],
        "image_size":           result['image_size'],
        "model_info":           result['model_info'],
        "training_data_saved":  training_saved,
        "note": "AI counts are estimates — review before optimising signals",
    })


@app.post("/detect/batch")
async def detect_batch(
    files: list[UploadFile] = File(...),
    junction_id: str = Form(default="unknown"),
):
    """Detect vehicles in multiple images at once (e.g. 4 junction cameras)."""
    if len(files) > 8:
        raise HTTPException(status_code=400, detail="Max 8 images per batch")

    results = []
    for f in files:
        img_bytes = await f.read()
        r = detect_from_bytes(img_bytes)
        results.append({
            "filename":         f.filename,
            "counts":           r['counts'],
            "total_vehicles":   r['total_vehicles'],
            "total_pcu":        r['total_pcu'],
            "congestion_level": r['congestion_level'],
        })

    return JSONResponse({"success": True, "results": results})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
