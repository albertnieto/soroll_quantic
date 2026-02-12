from huggingface_hub import model_info

try:
    info = model_info("cvssp/audioldm2-music")
    print(f"Successfully connected to Hub. Model info: {info.id}")
except Exception as e:
    print(f"Failed to connect to Hub: {e}")
