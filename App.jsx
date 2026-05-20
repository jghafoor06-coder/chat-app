import { StyleSheet, PermissionsAndroid, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import Root from './src/navigation/Root';
import messaging from '@react-native-firebase/messaging';
import { useEffect } from 'react';

const App = () => {
  const requestPermission = async () => {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        requestToken();
      } else {
        Alert.alert('permission dennied');
      }
    } catch (error) {
      console.log(error);
    }
  };

  const requestToken = async () => {
    try {
      await messaging().registerDeviceForRemoteMessages();
      const token = await messaging().getToken();
      console.log('token', token);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  return (
    <NavigationContainer>
      <Root />
    </NavigationContainer>
  );
};

export default App;

const styles = StyleSheet.create({});
