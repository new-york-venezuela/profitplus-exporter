# SP: pExportarRegistrosConfigFacturaVenta
**Tipo**: Procedimiento
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigFacturaVenta`](../tables/saConfigFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosConfigFacturaVenta
*DESCRIPCIÓN	:	Inserta una Configuración en la tabla saConfigFacturaVenta
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [dbo].[pExportarRegistrosConfigFacturaVenta]
    (
      @sCo_Config CHAR(6) ,
      @sDes_Config VARCHAR(60) ,
      @sCo_Usuario CHAR(6) = NULL ,
      @sCo_Mapa CHAR(6) = NULL ,
      @xXml_Squema XML = NULL ,
      @xXml_Data XML = NULL ,
      @xXml_Reglas XML = NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1),
      @sEmpresa				VARCHAR(60)
     
       )
AS 
    BEGIN
		DECLARE @sSql		NVARCHAR(1500) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarConfigFacturaVenta]	
																		@sCo_Config,
																		@sDes_Config,
																		@sCo_Usuario,
																		@sCo_Mapa,
																		@xXml_Squema,
																		@xXml_Data,
																		@xXml_Reglas,

																		@sCampo1,
																		@sCampo2,
																		@sCampo3,
																		@sCampo4,
																		@sCampo5,
																		@sCampo6,
																		@sCampo7,
																		@sCampo8,
																		@sCo_us_in,
																		@sCo_sucu_in,
																		@sMaquina,
																		@sRevisado,
																		@sTrasnfe'
										
		EXEC sp_executesql @sSql, N'		@sCo_Config				CHAR(6) ,
											@sDes_Config			VARCHAR(60) ,
											@sCo_Usuario			CHAR(6) ,
											@sCo_Mapa				CHAR(6) ,
											@xXml_Squema			XML,
											@xXml_Data				XML,
											 @xXml_Reglas			XML,
		
									@sCampo1 VARCHAR(60), 		@sCampo2 VARCHAR(60), 		@sCampo3 VARCHAR(60), 
									@sCampo4 VARCHAR(60), 		@sCampo5 VARCHAR(60), 		@sCampo6 VARCHAR(60), 
									@sCampo7 VARCHAR(60), 		@sCampo8 VARCHAR(60), 		@sCo_us_in CHAR(6), 		
									@sCo_sucu_in CHAR(6), 		@sMaquina VARCHAR(60),		@sRevisado CHAR(1), 
									@sTrasnfe CHAR(1)',
```
