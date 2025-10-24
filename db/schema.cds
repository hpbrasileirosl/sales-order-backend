using { managed } from '@sap/cds/common';

namespace sales;

entity SalesOrderHeaders : managed {
  key ID : UUID;
}