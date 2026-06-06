"""
prediction/train.py
--------------------
Module 3 — Generic ML Training Pipeline (CLI).

Usage:
    python train.py <csv_file> <target_column>

Example:
    python train.py patients.csv dropout

The script:
  1. Reads any CSV file
  2. Separates features from target
  3. Handles missing values
  4. Encodes categorical variables (OneHotEncoder)
  5. Scales numerical features (StandardScaler)
  6. Trains an XGBoost classifier
  7. Evaluates with Accuracy, Precision, Recall, F1, ROC-AUC
  8. Saves:
     - models/risk_model.pkl
     - models/preprocessor.pkl
     - models/feature_names.pkl
"""

import sys
import os
from pathlib import Path

# Ensure the project root is on sys.path so utils/ can be imported
_project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_project_root))

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    classification_report,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from utils.logger import get_logger

logger = get_logger("train")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODELS_DIR = _project_root / "models"
TEST_SIZE = 0.2
RANDOM_STATE = 42


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_dataset(csv_path: str, target_col: str) -> tuple[pd.DataFrame, pd.Series]:
    """Load CSV and split into X (features) and y (target)."""
    logger.info("Loading dataset: %s", csv_path)
    df = pd.read_csv(csv_path)

    if target_col not in df.columns:
        raise ValueError(
            f"Target column '{target_col}' not found in dataset. "
            f"Available columns: {list(df.columns)}"
        )

    logger.info("Dataset shape: %s | Target: %s", df.shape, target_col)
    logger.info("Target distribution:\n%s", df[target_col].value_counts().to_string())

    X = df.drop(columns=[target_col])
    y = df[target_col]

    # Drop columns that are entirely null
    null_cols = X.columns[X.isnull().all()].tolist()
    if null_cols:
        logger.warning("Dropping all-null columns: %s", null_cols)
        X = X.drop(columns=null_cols)

    return X, y


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    """
    Build a sklearn ColumnTransformer that handles:
      - Numeric columns : median imputation + StandardScaler
      - Categorical cols: most-frequent imputation + OneHotEncoder
    """
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()

    logger.info("Numeric features (%d): %s", len(numeric_cols), numeric_cols)
    logger.info("Categorical features (%d): %s", len(categorical_cols), categorical_cols)

    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    transformers = []
    if numeric_cols:
        transformers.append(("num", numeric_pipeline, numeric_cols))
    if categorical_cols:
        transformers.append(("cat", categorical_pipeline, categorical_cols))

    return ColumnTransformer(transformers=transformers, remainder="drop")


def get_feature_names(preprocessor: ColumnTransformer, X: pd.DataFrame) -> list[str]:
    """Extract all output feature names from the fitted ColumnTransformer."""
    names = []
    for name, transformer, cols in preprocessor.transformers_:
        if name == "remainder":
            continue
        if hasattr(transformer, "get_feature_names_out"):
            names.extend(transformer.get_feature_names_out(cols).tolist())
        else:
            names.extend(cols)
    return names


def train_model(X_train, y_train) -> XGBClassifier:
    """Train an XGBoost classifier with sensible defaults."""
    n_classes = len(np.unique(y_train))
    objective = "binary:logistic" if n_classes == 2 else "multi:softprob"

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="logloss",
        objective=objective,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    logger.info("Training XGBoost (objective=%s, n_estimators=300)…", objective)
    model.fit(X_train, y_train)
    return model


def evaluate_model(model, X_test, y_test) -> None:
    """Print evaluation metrics to stdout."""
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)

    n_classes = len(np.unique(y_test))
    avg = "binary" if n_classes == 2 else "weighted"

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average=avg, zero_division=0)
    rec = recall_score(y_test, y_pred, average=avg, zero_division=0)
    f1 = f1_score(y_test, y_pred, average=avg, zero_division=0)

    if n_classes == 2:
        auc = roc_auc_score(y_test, y_prob[:, 1])
    else:
        auc = roc_auc_score(y_test, y_prob, multi_class="ovr", average="weighted")

    separator = "=" * 50
    print(f"\n{separator}")
    print("  MODEL EVALUATION RESULTS")
    print(separator)
    print(f"  Accuracy  : {acc:.4f}")
    print(f"  Precision : {prec:.4f}")
    print(f"  Recall    : {rec:.4f}")
    print(f"  F1 Score  : {f1:.4f}")
    print(f"  ROC-AUC   : {auc:.4f}")
    print(separator)
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

    logger.info(
        "Metrics — Acc: %.4f | Prec: %.4f | Rec: %.4f | F1: %.4f | AUC: %.4f",
        acc, prec, rec, f1, auc,
    )


def save_artifacts(model, preprocessor, feature_names: list[str]) -> None:
    """Persist model + pipeline + feature names to models/."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODELS_DIR / "risk_model.pkl"
    preprocessor_path = MODELS_DIR / "preprocessor.pkl"
    feature_names_path = MODELS_DIR / "feature_names.pkl"

    joblib.dump(model, model_path)
    joblib.dump(preprocessor, preprocessor_path)
    joblib.dump(feature_names, feature_names_path)

    print(f"\n✅ Saved model        → {model_path}")
    print(f"✅ Saved preprocessor → {preprocessor_path}")
    print(f"✅ Saved feature names → {feature_names_path}")
    logger.info("All artifacts saved to %s/", MODELS_DIR)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) != 3:
        print("Usage: python train.py <csv_file> <target_column>")
        print("Example: python train.py patients.csv dropout")
        sys.exit(1)

    csv_path = sys.argv[1]
    target_col = sys.argv[2]

    if not os.path.isfile(csv_path):
        print(f"❌ File not found: {csv_path}")
        sys.exit(1)

    try:
        # 1. Load
        X, y = load_dataset(csv_path, target_col)

        # 2. Split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
        )
        logger.info("Split: train=%d, test=%d", len(X_train), len(X_test))

        # 3. Build + fit preprocessor
        preprocessor = build_preprocessor(X_train)
        X_train_t = preprocessor.fit_transform(X_train)
        X_test_t = preprocessor.transform(X_test)

        feature_names = get_feature_names(preprocessor, X_train)
        logger.info("Total features after preprocessing: %d", len(feature_names))

        # 4. Train
        model = train_model(X_train_t, y_train)

        # 5. Evaluate
        evaluate_model(model, X_test_t, y_test)

        # 6. Save
        save_artifacts(model, preprocessor, feature_names)

    except Exception as e:
        logger.error("Training failed: %s", e, exc_info=True)
        print(f"\n❌ Training failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
