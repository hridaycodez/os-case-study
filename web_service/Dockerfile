# Use an official Python base image
FROM python:3.9-slim
# Set the working directory
WORKDIR /app
# Install the only package we need
RUN pip install Flask
# Copy our app.py file into the image
COPY app.py .
# Tell the container to run our app when it starts
CMD ["python", "app.py"]