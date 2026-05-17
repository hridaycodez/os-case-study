from flask import Flask
import time
app = Flask(__name__)

@app.route('/')
def hello():
    # Simulate a tiny bit of work
    time.sleep(0.01) 
    return '{"status": "ok"}\n'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)