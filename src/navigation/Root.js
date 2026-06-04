import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './authstack/AuthStack';
import TabNavigation from './homestack/HomeStack';
import SplashScreen from '../screens/SplashScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import OutgoingCallScreen from '../screens/OutgoingCallScreen';
import WebRTCRoom from '../screens/WebRTCRoom';
import JoinScreen from '../screens/JoinScreen';

const Stack = createNativeStackNavigator();

const Root = () => {
  
  return (
    <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 250,
        }}
        initialRouteName='Splash'
      >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="authstack" component={AuthStack} />
      <Stack.Screen name="Tabnavigation" component={TabNavigation} />
      <Stack.Screen name="JoinCall" component={JoinScreen} />
      <Stack.Screen name="IncomingCall" component={IncomingCallScreen} />
      <Stack.Screen name="OutgoingCall" component={OutgoingCallScreen} />
      <Stack.Screen name="WebRTCRoom" component={WebRTCRoom} />
    </Stack.Navigator>
  );
};

export default Root;
