import os
from PIL import Image

def remove_white_background(img):
    img = img.convert("RGBA")
    datas = img.getdata()
    newData = []
    for item in datas:
        r, g, b, a = item
        # If it's solid white, make it fully transparent
        if r > 254 and g > 254 and b > 254:
            newData.append((0, 0, 0, 0))
        # If it's a shadow (neutral grey and somewhat bright)
        elif abs(r - g) < 8 and abs(g - b) < 8 and abs(r - b) < 8 and r > 120:
            # Reconstruct shadow transparency: darker means more opaque
            val = (r + g + b) // 3
            alpha = int((255 - val) * 1.3)  # Boost shadow a bit for visibility
            alpha = max(0, min(255, alpha))
            newData.append((0, 0, 0, alpha))
        # Semi-transparent edges (anti-aliasing)
        elif min(r, g, b) > 220:
            val = min(r, g, b)
            alpha = 255 - val
            newData.append((r, g, b, alpha))
        else:
            newData.append((r, g, b, 255))
    img.putdata(newData)
    return img

def fix_cabin_colors_9(img):
    img = img.convert("RGB")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if x > 700 and y < 400:
                r, g, b = pixels[x, y]
                # Check if it's yellow/brown wood
                if r > 120 and g > 100 and b < 130 and r > g + 20 and g > b + 20:
                    # Replace with crimson red/dark red
                    pixels[x, y] = (r, int(g * 0.2), int(b * 0.2))
    return img

def crop_and_resize(img_path, target_size, filename):
    img = Image.open(img_path)
    
    # Apply color correction only to 9.png
    if filename == "9.png":
        img = fix_cabin_colors_9(img)
        
    img_transparent = remove_white_background(img)
    
    # Crop to content bounding box
    bbox = img_transparent.getbbox()
    if bbox:
        cropped = img_transparent.crop(bbox)
    else:
        cropped = img_transparent
        
    # Resize to target size preserving aspect ratio or fitting
    resized = cropped.resize(target_size, Image.Resampling.LANCZOS)
    return resized

def main():
    # File paths for generated white-background images
    generated_files = {
        "1.png": r"C:\Users\marivana\.gemini\antigravity\brain\33d15959-2cc1-4b6f-aa54-1e695343c59d\red_ship_1_1782765831267.png",
        "3.png": r"C:\Users\marivana\.gemini\antigravity\brain\33d15959-2cc1-4b6f-aa54-1e695343c59d\red_ship_3_white_1782765873486.png",
        "9.png": r"C:\Users\marivana\.gemini\antigravity\brain\33d15959-2cc1-4b6f-aa54-1e695343c59d\red_ship_9_fixed_1782766060431.png",
        "11.png": r"C:\Users\marivana\.gemini\antigravity\brain\33d15959-2cc1-4b6f-aa54-1e695343c59d\red_ship_11_white_1782765920381.png"
    }
    
    # Target sizes for each ship state/direction
    target_sizes = {
        "1.png": (130, 128),
        "3.png": (128, 118),
        "9.png": (129, 126),
        "11.png": (126, 118)
    }
    
    # Create elit11 output directories
    out_dir = r"C:\Users\marivana\Desktop\SeaPirate\frontend\assets\ships\elitship\elit11"
    out_images_dir = os.path.join(out_dir, "images")
    os.makedirs(out_images_dir, exist_ok=True)
    
    for filename, src_path in generated_files.items():
        if os.path.exists(src_path):
            print(f"Processing {filename}...")
            size = target_sizes[filename]
            processed_img = crop_and_resize(src_path, size, filename)
            
            # Save to root of elit11 and inside images/ folder to match project structure
            processed_img.save(os.path.join(out_dir, filename), "PNG")
            processed_img.save(os.path.join(out_images_dir, filename), "PNG")
            print(f"Saved to {os.path.join(out_dir, filename)}")
        else:
            print(f"Source file not found: {src_path}")

if __name__ == "__main__":
    main()
