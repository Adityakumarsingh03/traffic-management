from ultralytics import YOLO
import numpy as np
from PIL import Image
import io
import os
import base64
import json

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'weights')
MODEL_PATH = os.path.join(WEIGHTS_DIR, 'yolov8n_indian.pt')
MODEL_INFO_PATH = os.path.join(WEIGHTS_DIR, 'model_info.json')

# ── Class name → canonical Indian vehicle type ────────────────────────────────
INDIAN_CLASS_MAP = {
    'car':             'car',
    'motorcycle':      'bike',
    'motorbike':       'bike',
    'bike':            'bike',
    'bus':             'bus',
    'truck':           'medium_truck',   # size-adjusted below
    'bicycle':         'cycle',
    'auto_rickshaw':   'auto_rickshaw',
    'auto':            'auto_rickshaw',
    'rickshaw':        'auto_rickshaw',
    'three_wheeler':   'auto_rickshaw',
    'e_rickshaw':      'e_rickshaw',
    'e-rickshaw':      'e_rickshaw',
    'tempo':           'tempo',
    'mini_truck':      'mini_truck',
    'medium_truck':    'medium_truck',
    'big_truck':       'big_truck',
    'heavy_truck':     'big_truck',
    'van':             'mini_truck',
    'pickup':          'mini_truck',
    'tractor':         'tractor',
    'cycle':           'cycle',
    'person':          None,
    'traffic light':   None,
    'stop sign':       None,
}

# ── Singular vehicle type → plural counts-dict key ───────────────────────────
# Cannot use simple `vtype + 's'` because 'bus'+'s' = 'buss', not 'buses'.
VTYPE_TO_COUNT_KEY: dict[str, str] = {
    'car':           'cars',
    'bike':          'bikes',
    'bus':           'buses',        # ← irregular plural
    'mini_truck':    'mini_trucks',
    'medium_truck':  'medium_trucks',
    'big_truck':     'big_trucks',
    'cycle':         'cycles',
    'auto_rickshaw': 'auto_rickshaws',
    'e_rickshaw':    'e_rickshaws',
    'tempo':         'tempos',
    'tractor':       'tractors',
}

# ── PCU weights for Indian vehicles ──────────────────────────────────────────
INDIAN_PCU_WEIGHTS = {
    'car':           1.0,
    'bike':          0.75,
    'auto_rickshaw': 1.2,
    'bus':           3.5,
    'mini_truck':    1.5,
    'medium_truck':  2.0,
    'big_truck':     3.0,
    'cycle':         0.5,
    'e_rickshaw':    0.8,
    'tempo':         1.8,
    'tractor':       2.5,
}

_model = None


def load_model():
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            print("Model not found, downloading...")
            from download_pretrained import get_best_model
            get_best_model()

        if not os.path.exists(MODEL_PATH):
            print("Falling back to default YOLOv8n...")
            _model = YOLO('yolov8n.pt')
        else:
            _model = YOLO(MODEL_PATH)

        print(f"Model loaded: {len(_model.names)} classes")
        print(f"Classes: {list(_model.names.values())}")
    return _model


def get_model_info() -> dict:
    if os.path.exists(MODEL_INFO_PATH):
        with open(MODEL_INFO_PATH) as f:
            return json.load(f)
    return {'name': 'YOLOv8n', 'source': 'default'}


def map_class_to_indian(
    class_name: str, box_w: int, box_h: int, img_w: int, img_h: int
) -> str | None:
    """Map a raw YOLO class name to a canonical Indian vehicle type.

    For the generic 'truck' class, use bounding-box area as a proxy for size
    to distinguish mini / medium / big trucks.
    """
    class_lower = class_name.lower().replace(' ', '_')

    mapped = INDIAN_CLASS_MAP.get(class_lower)
    if mapped is None:
        return None

    # Refine truck size by bounding-box area relative to image
    if mapped in ('medium_truck', 'mini_truck', 'big_truck') or class_lower == 'truck':
        ratio = (box_w * box_h) / (img_w * img_h)
        if ratio < 0.015:
            return 'mini_truck'
        elif ratio < 0.045:
            return 'medium_truck'
        else:
            return 'big_truck'

    return mapped


def detect_from_bytes(image_bytes: bytes) -> dict:
    model = load_model()

    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img_array = np.array(image)
    img_h, img_w = img_array.shape[:2]

    results = model(
        img_array,
        conf=0.25,
        iou=0.45,
        verbose=False,
    )

    counts = {
        'cars':          0,
        'bikes':         0,
        'buses':         0,
        'mini_trucks':   0,
        'medium_trucks': 0,
        'big_trucks':    0,
        'cycles':        0,
        'auto_rickshaws':0,
        'e_rickshaws':   0,
        'tempos':        0,
        'tractors':      0,
    }

    detections = []
    total_pcu  = 0.0

    for result in results:
        for box in result.boxes:
            cls_id     = int(box.cls[0])
            conf       = float(box.conf[0])
            class_name = model.names[cls_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            bw = x2 - x1
            bh = y2 - y1

            vtype = map_class_to_indian(class_name, bw, bh, img_w, img_h)
            if vtype is None:
                continue

            count_key = VTYPE_TO_COUNT_KEY.get(vtype)
            if count_key and count_key in counts:
                counts[count_key] += 1

            pcu        = INDIAN_PCU_WEIGHTS.get(vtype, 1.0)
            total_pcu += pcu

            detections.append({
                'type':           vtype,
                'original_class': class_name,
                'confidence':     round(conf, 3),
                'bbox':           [x1, y1, x2, y2],
                'pcu':            pcu,
                'label':          f"{vtype.replace('_', ' ')} {round(conf * 100)}%",
            })

    # Build annotated JPEG (BGR→RGB handled by plot())
    annotated     = results[0].plot()
    annotated_pil = Image.fromarray(annotated[..., ::-1])
    buf           = io.BytesIO()
    annotated_pil.save(buf, format='JPEG', quality=85)
    annotated_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    density = min(total_pcu / 50.0, 1.0)
    if density < 0.3:
        congestion = 'low'
    elif density < 0.6:
        congestion = 'medium'
    elif density < 0.85:
        congestion = 'high'
    else:
        congestion = 'critical'

    return {
        'counts':           counts,
        'detections':       detections,
        'total_vehicles':   sum(counts.values()),
        'total_pcu':        round(total_pcu, 2),
        'density':          round(density * 100, 1),
        'congestion_level': congestion,
        'annotated_image':  f"data:image/jpeg;base64,{annotated_b64}",
        'image_size':       {'width': img_w, 'height': img_h},
        'model_info':       get_model_info(),
    }


def detect_from_frame(frame_array: np.ndarray) -> dict:
    buf = io.BytesIO()
    Image.fromarray(frame_array[..., ::-1]).save(buf, format='JPEG', quality=90)
    return detect_from_bytes(buf.getvalue())


def save_detection_for_training(
    image_bytes: bytes,
    result: dict,
    junction_id: str,
    direction: str,
) -> str:
    """
    Save detected image + YOLO-format labels for future fine-tuning on
    Jamshedpur-specific data.  Called after every successful production
    detection to build a local dataset automatically.

    Label format: <class_id> <cx> <cy> <bw> <bh>  (normalised, 0-1)
    class_id = index in INDIAN_PCU_WEIGHTS.keys()
    """
    training_dir = os.path.join(
        os.path.dirname(__file__), '..',
        'training_data',
        f'junction_{junction_id}',
        direction,
    )
    images_dir = os.path.join(training_dir, 'images')
    labels_dir = os.path.join(training_dir, 'labels')
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(labels_dir, exist_ok=True)

    import time
    timestamp = int(time.time())

    img_path = os.path.join(images_dir, f"{timestamp}.jpg")
    with open(img_path, 'wb') as f:
        f.write(image_bytes)

    img_w = result['image_size']['width']
    img_h = result['image_size']['height']

    class_names = list(INDIAN_PCU_WEIGHTS.keys())
    label_path  = os.path.join(labels_dir, f"{timestamp}.txt")

    with open(label_path, 'w') as f:
        for det in result['detections']:
            x1, y1, x2, y2 = det['bbox']
            cx = ((x1 + x2) / 2) / img_w
            cy = ((y1 + y2) / 2) / img_h
            bw = (x2 - x1) / img_w
            bh = (y2 - y1) / img_h

            cls_id = class_names.index(det['type']) if det['type'] in class_names else 0
            f.write(f"{cls_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")

    print(f"Saved training sample: {img_path}")
    return img_path
