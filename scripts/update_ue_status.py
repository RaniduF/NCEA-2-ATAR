import sys
import os
import pandas as pd

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from backend.app.db.session import SessionLocal
from backend.app.models.standard_models import Standard


def update_ue_status():
    """
    Reads a CSV, specifically parsing the 'Achievement Standards' column which may
    contain comma-separated values, to update the 'is_ue' flag in the database.
    """
    print("Starting UE status update process...")

    # Assumes UE_subjects.csv is in the project root. Update path if needed.
    ue_subjects_path = os.path.join(project_root, 'ue_subjects_2025-07-20.csv')

    try:
        ue_df = pd.read_csv(ue_subjects_path)
        print(f"Loaded UE subjects data from '{ue_subjects_path}'.")
    except FileNotFoundError:
        print(
            f"Error: Could not find the UE subjects file at '{ue_subjects_path}'.")
        return

    # --- NEW: Logic to parse the specific 'Achievement Standards' column ---
    ue_standards_set = set()

    # Clean column names to remove potential leading/trailing spaces
    ue_df.columns = [col.strip() for col in ue_df.columns]
    target_column = 'Achievement Standards'

    if target_column in ue_df.columns:
        # Iterate over each cell in the target column that is not empty
        for cell_value in ue_df[target_column].dropna():
            # Split the string by commas to handle multiple standards in one cell
            standard_numbers_as_strings = str(cell_value).split(',')

            for std_num_str in standard_numbers_as_strings:
                try:
                    # Trim whitespace from the string before converting to an integer
                    ue_standards_set.add(int(std_num_str.strip()))
                except ValueError:
                    print(
                        f"Warning: Found non-numeric value '{std_num_str.strip()}' in cell '{cell_value}'. Skipping.")
    else:
        print(
            f"Error: The required column '{target_column}' was not found in the CSV file.")
        return

    print(
        f"Found {len(ue_standards_set)} unique UE-approved standards across all subjects.")

    db_session = SessionLocal()
    try:
        all_standards = db_session.query(Standard).all()
        print(
            f"Updating UE status for {len(all_standards)} standards in the database...")

        updated_count = 0
        for standard in all_standards:
            # Check if the standard's number is in the set of UE standards
            if standard.standard_number in ue_standards_set:
                standard.is_ue = True
                updated_count += 1

        print(f"Marked {updated_count} standards as UE-approved.")
        print("Committing changes to the database...")
        db_session.commit()
        print("✅ UE status update complete!")

    except Exception as e:
        print(f"❌ An error occurred during database processing: {e}")
        db_session.rollback()
    finally:
        print("Closing database session.")
        db_session.close()


if __name__ == "__main__":
    update_ue_status()
