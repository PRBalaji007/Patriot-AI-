# PATRIOT Backend — FastAPI + MobileNetV3

This folder contains a FastAPI inference backend and the two trained Keras models
provided for PATRIOT:
- `civic_issues_mobilenetv3.keras`
- `disasters_accidents_mobilenetv3.keras`

## What is included

- FastAPI application and interactive OpenAPI docs.
- JPEG/PNG/WEBP upload validation and upload-size limit.
- Lazy loading of both Keras models.
- Independent predictions from either model or both models.
- Confidence score and low-confidence/manual-review flag.
- Preliminary department suggestion only after class labels are configured.
- Offline evaluation script for labelled test folders.
- Environment-variable placeholders for a later server-side Supabase integration.

## Important model facts

Both uploaded `.keras` archives were inspected:
- input shape: `(None, 224, 224, 3)`
- final layer: six units with softmax activation
- architecture includes MobileNetV3Large

The original class-name mapping is not stored in the supplied `.keras` config.
`models/class_names.json` therefore uses `UNMAPPED_CLASS_0` through
`UNMAPPED_CLASS_5`. Replace these with the exact class order from training.
Until then, predictions return class indices, not fabricated category names,
and department suggestions remain `null`.

The inference preprocessing passes RGB float32 pixels in the 0..255 range.
The supplied MobileNetV3 architecture includes its preprocessing layer.
Do not add a second `/255` normalization without checking the original training
pipeline.

## Setup on Windows / VS Code

Use Python 3.11 or 3.12 in a fresh virtual environment.

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks activation, run this once in that terminal:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

Open:
- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health

## Prediction API

`POST /api/predict`

Multipart form fields:
- `file`: image file
- `model`: `both` (default), `civic_issues`, or `disasters_accidents`

The `both` response contains two independent predictions. Do not compare their
confidence values as if they belonged to a common class space.

## Configure class names

Edit `models/class_names.json` using the exact order from the original training
dataset loader. Example structure only:

```json
{
  "civic_issues": ["exact_class_0", "exact_class_1", "exact_class_2",
                  "exact_class_3", "exact_class_4", "exact_class_5"],
  "disasters_accidents": ["exact_class_0", "exact_class_1", "exact_class_2",
                          "exact_class_3", "exact_class_4", "exact_class_5"]
}
```

Do not copy the example labels literally.

## Accuracy / evaluation

A single prediction confidence is not model accuracy. Accuracy requires ground
truth labels from a separate held-out test dataset. Organize the test images as:

```text
test_dataset/
  exact_class_0/
  exact_class_1/
  exact_class_2/
  exact_class_3/
  exact_class_4/
  exact_class_5/
```

After configuring the exact class order, run from `backend`:

```powershell
python scripts/evaluate.py --model civic_issues --dataset "C:\path\to\civic_test"
python scripts/evaluate.py --model disasters_accidents --dataset "C:\path\to\disaster_test"
```

This prints accuracy, precision, recall, F1 and confusion matrix. It evaluates
the supplied weights; it does not retrain them. The results are only valid if
the provided folder is a genuinely held-out labelled test split.

## Supabase

Supabase credentials are intentionally not embedded. The current project should
keep its existing frontend Supabase configuration. The backend `.env` contains
placeholders for a future server-side integration. Never expose
`SUPABASE_SERVICE_ROLE_KEY` in browser code, public repositories, or shared ZIPs.

## Current scope / not yet connected

- This backend does not write reports to Supabase.
- Department suggestions are preliminary keyword mapping, not automatic
  assignment to a real department record.
- Authentication/authorization for protected backend operations must be added
  before public deployment.
- No claim is made that the model is production-ready solely because it loads.
