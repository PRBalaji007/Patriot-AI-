"""
Evaluate one supplied classifier against a labelled folder dataset.

Expected dataset layout:
dataset_root/
  class_name_1/
    image1.jpg
  class_name_2/
    image2.jpg

The folder names and order must exactly match models/class_names.json.
This reports held-out dataset metrics; it does not calculate accuracy from a
single uploaded image and does not retrain the model.
"""
import argparse
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageOps
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import settings
from app.services.classifier import _load_model

EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, choices=["civic_issues", "disasters_accidents"])
    parser.add_argument("--dataset", required=True, type=Path)
    args = parser.parse_args()

    mapping = json.loads(settings.class_map_path.read_text(encoding="utf-8"))
    class_names = mapping.get(args.model, [])
    if len(class_names) != 6 or any(name.startswith("UNMAPPED_CLASS_") for name in class_names):
        raise SystemExit("Configure the exact six class names in models/class_names.json first.")

    model = _load_model(args.model)
    y_true, y_pred = [], []
    for class_index, class_name in enumerate(class_names):
        folder = args.dataset / class_name
        if not folder.is_dir():
            raise SystemExit(f"Missing class folder: {folder}")
        for path in sorted(folder.rglob("*")):
            if path.suffix.lower() not in EXTENSIONS:
                continue
            try:
                with Image.open(path) as image:
                    image = ImageOps.exif_transpose(image).convert("RGB").resize((224, 224))
                    batch = np.expand_dims(np.asarray(image, dtype=np.float32), 0)
                scores = np.asarray(model.predict(batch, verbose=0)).reshape(-1)
                y_true.append(class_index)
                y_pred.append(int(np.argmax(scores)))
            except Exception as exc:
                print(f"Skipping {path}: {exc}")

    if not y_true:
        raise SystemExit("No valid images found in the labelled dataset.")

    print(f"Model: {args.model}")
    print(f"Evaluated images: {len(y_true)}")
    print(f"Accuracy: {accuracy_score(y_true, y_pred):.4f}")
    print("\nClassification report:")
    print(classification_report(y_true, y_pred, labels=list(range(6)),
                                target_names=class_names, zero_division=0))
    print("Confusion matrix:")
    print(confusion_matrix(y_true, y_pred, labels=list(range(6))))

if __name__ == "__main__":
    main()
