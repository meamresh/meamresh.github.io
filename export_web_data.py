import numpy as np
import json
import os

def export_data_for_web():
    data_dir = "data/processed"
    output_file = "data/processed/web_data.json"
    
    # Load binary data
    dates = np.load(os.path.join(data_dir, "dates.npy"), allow_pickle=True)
    obs = np.load(os.path.join(data_dir, "observations.npy"))
    
    # Convert dates to ISO strings for JSON
    date_strs = [str(d) for d in dates]
    
    # Structure data
    web_data = {
        "dates": date_strs,
        "observations": obs.tolist(),
        "assets": ["SPY", "TLT", "HYG"]
    }
    
    with open(output_file, 'w') as f:
        json.dump(web_data, f)
    
    print(f"Exported web-friendly data to {output_file}")

if __name__ == "__main__":
    export_data_for_web()
