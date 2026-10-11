import React from 'react';
import { PassportManagementView, PassportManagementViewProps } from './PassportManagementView';

export * from './PassportManagementView';

export const PassportCustodyView: React.FC<PassportManagementViewProps> = (props) => {
  return <PassportManagementView {...props} />;
};

export default PassportCustodyView;
