"""
FUTURE TRAINING PIPELINE
Run this when you have full dataset access.
Uses all 3 datasets + collected Jamshedpur data.

Usage:
    cd model
    python src/train_pipeline.py
    # Enter Roboflow API key when prompted
    # Training takes 4-6 hours on GPU, 2-3 days on CPU
    # Use Google Colab for free GPU
"""

import os
import yaml
import shutil
from pathlib import Path

DATASETS = {
    'idd': {
        'name':        'India Driving Dataset',
        'source':      'roboflow',
        'workspace':   'idd-dataset',
        'project':     'idd-segmentation',
        'version':     1,
        'description': 'IIT Hyderabad Indian driving dataset, 10000+ images',
    },
    'acid': {
        'name':        'ACID Dataset',
        'source':      'roboflow',
        'workspace':   'acid-dataset',
        'project':     'auto-rickshaw-detection',
        'version':     1,
        'description': 'Auto rickshaw and Indian 3-wheeler detection',
    },
    'indian_traffic': {
        'name':        'Indian Traffic Detection',
        'source':      'roboflow',
        'workspace':   'indian-traffic',
        'project':     'indian-vehicle-detection',
        'version':     1,
        'description': 'Dense Indian traffic, junction cameras',
    },
    'jamshedpur': {
        'name':        'Jamshedpur Local Data',
        'source':      'local',
        'path':        'training_data/',
        'description': 'Collected from Jamshedpur junctions — grows as system runs',
    },
}

VEHICLE_CLASSES = [
    'car',
    'bike',
    'auto_rickshaw',
    'bus',
    'mini_truck',
    'medium_truck',
    'big_truck',
    'cycle',
    'e_rickshaw',
    'tempo',
    'tractor',
]


# ── Dataset acquisition ───────────────────────────────────────────────────────

def download_all_datasets(roboflow_api_key: str) -> str:
    from roboflow import Roboflow
    rf = Roboflow(api_key=roboflow_api_key)

    merged_dir = Path('training_data/merged')
    for split in ('train', 'val'):
        (merged_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
        (merged_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)

    for key, dataset in DATASETS.items():
        if dataset['source'] == 'roboflow':
            print(f"Downloading {dataset['name']}...")
            try:
                project = rf.workspace(dataset['workspace']).project(dataset['project'])
                version = project.version(dataset['version'])
                version.download('yolov8', location=f'training_data/raw/{key}')
                merge_into_combined(f'training_data/raw/{key}', str(merged_dir))
                print(f"{dataset['name']} downloaded and merged")
            except Exception as e:
                print(f"Failed to download {dataset['name']}: {e}")

    merge_jamshedpur_data(str(merged_dir))
    return str(merged_dir)


def merge_into_combined(source_dir: str, target_dir: str) -> None:
    for split in ('train', 'val'):
        src_images = Path(source_dir) / 'images' / split
        src_labels = Path(source_dir) / 'labels' / split

        if src_images.exists():
            for img in src_images.glob('*'):
                shutil.copy(img, Path(target_dir) / 'images' / split / img.name)

        if src_labels.exists():
            for lbl in src_labels.glob('*'):
                shutil.copy(lbl, Path(target_dir) / 'labels' / split / lbl.name)


def merge_jamshedpur_data(target_dir: str) -> None:
    jamshedpur_dir = Path('training_data')

    for junction_dir in jamshedpur_dir.glob('junction_*'):
        for direction_dir in junction_dir.glob('*'):
            images_dir = direction_dir / 'images'
            labels_dir = direction_dir / 'labels'

            if images_dir.exists():
                for img in images_dir.glob('*.jpg'):
                    shutil.copy(
                        img,
                        Path(target_dir) / 'images' / 'train' / f"jsr_{img.name}",
                    )

            if labels_dir.exists():
                for lbl in labels_dir.glob('*.txt'):
                    shutil.copy(
                        lbl,
                        Path(target_dir) / 'labels' / 'train' / f"jsr_{lbl.name}",
                    )

    print("Jamshedpur data merged into training set")


# ── Dataset YAML ──────────────────────────────────────────────────────────────

def create_dataset_yaml(dataset_dir: str) -> str:
    yaml_content = {
        'path':  os.path.abspath(dataset_dir),
        'train': 'images/train',
        'val':   'images/val',
        'nc':    len(VEHICLE_CLASSES),
        'names': VEHICLE_CLASSES,
    }

    yaml_path = os.path.join(dataset_dir, 'dataset.yaml')
    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_content, f, default_flow_style=False)

    print(f"Dataset YAML created: {yaml_path}")
    return yaml_path


# ── Training ──────────────────────────────────────────────────────────────────

def train_model(dataset_yaml: str, epochs: int = 100, use_pretrained: bool = True):
    from ultralytics import YOLO

    base_model = 'yolov8n.pt' if use_pretrained else 'yolov8n.yaml'
    model      = YOLO(base_model)

    print(f"Starting training on {dataset_yaml}")
    print(f"Classes: {VEHICLE_CLASSES}")
    print(f"Epochs:  {epochs}")

    results = model.train(
        data=dataset_yaml,
        epochs=epochs,
        imgsz=640,
        batch=16,
        name='jamshedpur_traffic',
        patience=20,
        save=True,
        device='0' if os.path.exists('/dev/nvidia0') else 'cpu',
        augment=True,
        mosaic=1.0,
        mixup=0.1,
        degrees=5.0,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
    )

    best_model_path = 'runs/detect/jamshedpur_traffic/weights/best.pt'
    final_path      = os.path.join(
        os.path.dirname(__file__), '..', 'weights', 'yolov8n_indian.pt'
    )

    if os.path.exists(best_model_path):
        shutil.copy(best_model_path, final_path)
        print(f"Best model saved to {final_path}")
        print(f"mAP50: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")

    return results


# ── Full pipeline ─────────────────────────────────────────────────────────────

def run_full_training_pipeline(roboflow_api_key: str) -> None:
    print("=== JAMSHEDPUR TRAFFIC MODEL TRAINING PIPELINE ===")
    print("Datasets: IDD + ACID + Indian Traffic + Jamshedpur Local")
    print(f"Classes:  {len(VEHICLE_CLASSES)} vehicle types")

    print("\nStep 1: Downloading all datasets...")
    dataset_dir = download_all_datasets(roboflow_api_key)

    print("\nStep 2: Creating dataset configuration...")
    yaml_path = create_dataset_yaml(dataset_dir)

    print("\nStep 3: Training model...")
    train_model(yaml_path, epochs=100)

    print("\n=== TRAINING COMPLETE ===")
    print("New model saved to weights/yolov8n_indian.pt")
    print("Restart the API server to use the new model")


if __name__ == "__main__":
    api_key = input("Enter Roboflow API key: ").strip()
    run_full_training_pipeline(api_key)
