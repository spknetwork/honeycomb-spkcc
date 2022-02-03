FROM ubuntu:18.04
# MAINTAINER PeerPlays Blockchain Standards Association

RUN \
    apt-get update -y && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y \
      build-essential \
      libssl-dev \
      libffi-dev \
      python3.8 \
      python3.8-dev \
      python3-pip \
      virtualenv \
      git

RUN python3.8 -m pip install --upgrade pip

#Copy the source code
COPY . /snapshot/
RUN git clone https://gitlab.com/PBSA/3speak-integration.git -b wip-main 
WORKDIR /3speak-integration/claimdropweb
#Installing the requirements
RUN pip3 install -r requirements.txt
RUN sed -i 's/^}/    "IRONA":{\n        "chain_id":"bec1b83fc4752ad319dfc4e9f1fac37d8fb06c77382ad74438a827a4b16f2e9e",\n        "core_symbol":"TEST",\n        "prefix":"TEST",\n    },\n}/' /usr/local/lib/python3.8/dist-packages/peerplaysbase/chains.py

RUN python3.8 manage.py migrate

EXPOSE 8001

CMD ["python3.8", "manage.py", "runserver", "0.0.0.0:8001"]
