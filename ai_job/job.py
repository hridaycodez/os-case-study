import numpy as np
import time

print("Starting CPU-intensive 'AI' job...")
while True:
    # This is a heavy math problem that uses a lot of CPU
    x = np.random.rand(2000, 2000)
    y = np.linalg.svd(x)
    print(f"...computation cycle finished.")
    # We add a tiny sleep so it doesn't overwhelm your computer
    time.sleep(0.1)