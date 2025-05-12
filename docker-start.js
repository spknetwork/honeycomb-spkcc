import fetch from 'node-fetch';
import { spawn } from 'child_process';

ping();

const ping = () => {
  fetch(`http://${process.env.ipfshost}:${process.env.ipfsport}/ping`)
    .then(res => res.text())
    .then(text => {
      console.log('Deploying:');
      spawn('node', ['index'], { stdio: 'inherit' });
    })
    .catch(err => {
      console.log('Waiting for IPFS...');
      setTimeout(ping, 2000);
    });
};