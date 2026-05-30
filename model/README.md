# Jamshedpur Traffic AI — YOLOv8 Vehicle Detection Model

Indian-road-aware vehicle detection micro-service that powers the
Jamshedpur Traffic Management Dashboard.

## Vehicle Classes (11 types)

| Class | PCU Weight | Notes |
|-------|-----------|-------|
| car | 1.0 | Standard private car |
| bike | 0.75 | Motorcycle / moped |
| **auto_rickshaw** | **1.2** | Indian 3-wheeler, common in Jamshedpur |
| bus | 3.5 | City / intercity bus |
| mini_truck | 1.5 | Bolero, van, pickup ≤ 1T |
| medium_truck | 2.0 | Medium commercial vehicle |
| big_truck | 3.0 | Heavy goods vehicle |
| cycle | 0.5 | Pedal bicycle |
| **e_rickshaw** | **0.8** | Electric rickshaw, popular in urban India |
| **tempo** | **1.8** | 3-wheel goods carrier |
| **tractor** | **2.5** | Agricultural / construction tractor |

PCU weights follow IRC:106-1990 adapted for dense Indian urban traffic.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Download best available pretrained model
python src/download_pretrained.py

# Start API server
python src/api.py
# → http://localhost:8000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health + model info |
| `/detect` | POST | Detect vehicles in an image |
| `/detect/batch` | POST | Detect in multiple images |
| `/model-info` | GET | Detailed model metadata |

### Example detection call

```bash
curl -X POST http://localhost:8000/detect \
  -F "file=@road_image.jpg" \
  -F "junction_id=1" \
  -F "direction=N"
```

## Model Priority

1. **Roboflow** — `indian-traffic/indian-vehicle-detection` (IDD + ACID + Indian Traffic)
   — best for Indian roads, requires `ROBOFLOW_API_KEY`
2. **Hugging Face** — `keremberke/yolov8n-vehicle-detection` (mAP ~78%)
3. **Fallback** — YOLOv8n COCO (mAP ~65 %)

## Auto-Collected Training Data

Every production detection is saved to `training_data/junction_<id>/<direction>/`.
When you have enough data, run the fine-tuning pipeline:

```bash
python src/train_pipeline.py
# Enter Roboflow API key when prompted
# Downloads: IDD + ACID + Indian Traffic datasets
# Merges with collected Jamshedpur data
# Trains for 100 epochs
# Saves best.pt → weights/yolov8n_indian.pt
# Restart API to use improved model
```

## Deploy on Railway

1. railway.app → your project → **+ New Service**
2. GitHub Repo → `traffic-management`
3. Root Directory: `model`
4. Variables: `PORT = 8000`
5. Generate Domain → copy URL
6. Backend service → Variables → `MODEL_API_URL = <that URL>`
7. Redeploy backend
