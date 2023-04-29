#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MetabsePracticeBastionToRdsStack } from '../lib/metabse-practice-bastion-to-rds-stack';

const app = new cdk.App();
new MetabsePracticeBastionToRdsStack(app, 'MetabsePracticeBastionToRdsStack');
