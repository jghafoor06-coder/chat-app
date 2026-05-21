import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import Root from './src/navigation/Root';

const App = () => {
  return (
    <NavigationContainer>
      <Root />
    </NavigationContainer>
  );
};

export default App;

const styles = StyleSheet.create({});
