import React from 'react';
import { Switch, Route } from 'react-router-dom';
import CompareShows from './ExampleTwoDeepComponent';
import PageNotFound from './PageNotFound';
import s from '../styles/app.style';

import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';

export default function App() {
  return (
      <MuiThemeProvider>
          <div style={s.root}>
              <Switch>
                  <Route path="/" component={CompareShows} />
                  <Route component={PageNotFound} />
              </Switch>
          </div>
      </MuiThemeProvider>
  );
}
