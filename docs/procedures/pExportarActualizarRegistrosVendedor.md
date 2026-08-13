# SP: pExportarActualizarRegistrosVendedor
**Tipo**: Procedimiento
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosVendedor
*DESCRIPCIÓN	:	Inserta un Vendedor
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosVendedor]
    (
      @sCo_Ven                    CHAR(6) ,
      @sCo_VenOri          CHAR(6) ,
      @sTipo               CHAR(1) ,
      @sVen_Des                   VARCHAR(60) ,
      @sDis_Cen                   VARCHAR(MAX) = NULL ,
      @sCedula                    CHAR(16) = NULL ,
      @sDirec1                    VARCHAR(MAX) = NULL ,
      @sDirec2                    VARCHAR(MAX) = NULL ,
      @sTelefonos          VARCHAR(60) = NULL ,
      @sdFecha_Reg         SMALLDATETIME ,
      @bInactivo           BIT ,
      @deComision          DECIMAL(18, 2) = NULL ,
      @sComen              VARCHAR(MAX) = NULL ,
      @bFun_Cob                   BIT ,
      @bFun_Ven                   BIT ,
      @deComisionV         DECIMAL(18, 2) = NULL ,
      @sLogin              VARCHAR(50) = NULL ,
      @sPassword           VARCHAR(50) = NULL ,
      @sEmail              VARCHAR(60) = NULL ,
      @sPSW_M              VARCHAR(20) = NULL ,
      @sCampo1                    VARCHAR(60)                = NULL ,
      @sCampo2                    VARCHAR(60)                = NULL ,
      @sCampo3                    VARCHAR(60)                = NULL ,
      @sCampo4                    VARCHAR(60)                = NULL ,
      @sCampo5                    VARCHAR(60)                = NULL ,
      @sCampo6                    VARCHAR(60)                = NULL ,
      @sCampo7                    VARCHAR(60)                = NULL ,
      @sCampo8                    VARCHAR(60)                = NULL ,
      @sCampos                    VARCHAR(MAX),       
      @sCo_us_in           CHAR(6) ,
      @sCo_sucu_in         CHAR(6)                           = NULL ,
      @dFe_us_in           VARCHAR(60)                = NULL ,
      @sCo_us_mo           CHAR(6)                           = NULL ,
      @sCo_sucu_mo         CHAR(6)                           = NULL ,
      @sRevisado           CHAR(1) = '',
      @sTrasnfe                   CHAR(1) = '',
      @sEmpresa                   VARCHAR(60),
      @sMaquina                   VARCHAR(60),
      @gRowguid                   UNIQUEIDENTIFIER    = NULL,
         @sco_zon
```
