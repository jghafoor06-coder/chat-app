import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './authstack/AuthStack';
import TabNavigation from './homestack/HomeStack';
import SplashScreen from '../screens/SplashScreen';

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
    </Stack.Navigator>
  );
};

export default Root;
