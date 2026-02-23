import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import OceanScene from './components/OceanScene';
import HUDOverlay from './components/HUDOverlay';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        <View style={styles.root}>
          <OceanScene />
          <HUDOverlay />
          <StatusBar style="light" />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

var styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#001B2E'
  }
});
