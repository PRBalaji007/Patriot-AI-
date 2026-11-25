The two trained model files are included in this folder.

IMPORTANT:
- The .keras model configs confirm 224x224 RGB input and a 6-unit softmax output.
- The model files do not contain the original class-name mapping.
- Replace the six UNMAPPED_CLASS_0 ... UNMAPPED_CLASS_5 entries in class_names.json
  with the exact class names in the same order used by ImageFolder / training.
- Do not guess or alphabetically reorder the labels unless that matches training.
- The model includes MobileNetV3 preprocessing. The backend supplies RGB pixel
  values in the 0..255 range and does not apply an additional /255 normalization.
