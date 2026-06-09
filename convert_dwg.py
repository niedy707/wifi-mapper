import sys
import os
import traceback

def run_conversion():
    try:
        import aspose.cad as cad
        from aspose.cad.imageoptions import PngOptions, CadRasterizationOptions
        
        dwg_path = "/Users/ibrahimyagci/Downloads/C3-15inci kat plan.dwg"
        png_path = "/Users/ibrahimyagci/Projects/NAS-Sync/wifi-mapper/public/kat-plani.png"
        
        print("Loading DWG file...", flush=True)
        if not os.path.exists(dwg_path):
            print(f"Error: DWG file not found at {dwg_path}", flush=True)
            return
            
        image = cad.Image.load(dwg_path)
        
        print("Configuring rasterization options...", flush=True)
        rasterization_options = CadRasterizationOptions()
        
        # Set large size to preserve details
        rasterization_options.page_width = 3000
        rasterization_options.page_height = 2000
        
        # Try to set layout to Model space
        try:
            rasterization_options.layouts = ["Model"]
        except Exception as e:
            print(f"Could not set layouts = ['Model']: {e}", flush=True)
            try:
                rasterization_options.layout = "Model"
            except Exception as e2:
                print(f"Could not set layout = 'Model': {e2}", flush=True)
        
        # Make background white and lines visible
        rasterization_options.background_color = cad.Color.white
        
        print("Configuring PNG options...", flush=True)
        png_options = PngOptions()
        png_options.vector_rasterization_options = rasterization_options
        
        print("Saving to PNG (this may take a few seconds)...", flush=True)
        image.save(png_path, png_options)
        print(f"Conversion successful! Saved to: {png_path}", flush=True)
        
    except Exception as e:
        print("Error during conversion:", flush=True)
        traceback.print_exc()

if __name__ == "__main__":
    run_conversion()
