import path from 'node:path';
import { getDefaultConfig } from 'expo/metro-config.js';

var projectRoot = process.cwd();

var config = getDefaultConfig(projectRoot);
var threePath = path.resolve(projectRoot, 'node_modules/three');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  three: threePath
};

if (!config.resolver.assetExts.includes('fbx')) {
  config.resolver.assetExts.push('fbx');
}

export default config;
