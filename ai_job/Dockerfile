# Use an official Python base image
FROM python:3.9-slim
# Set the working directory
WORKDIR /app
# Install the only package we need
RUN pip install numpy
# Copy our job.py file into the image
COPY job.py .
# Tell the container to run our job when it starts
CMD ["python", "job.py"]