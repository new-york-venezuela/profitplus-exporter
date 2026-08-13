# SP: pObtenerListadoDatosOrdenPago
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosOrdenPago]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
Create PROCEDURE [dbo].[pObtenerListadoDatosOrdenPago]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
	  @sTable_Name					VARCHAR(50)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
      @bAplica_Anulado				BIT					= NULL,
      @bAnulado						BIT					= NULL,
      
      @bAplica_Status				BIT					= NULL,
      @sStatus						CHAR(1)				= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,
      
      @bAplica_Beneficiario			BIT					= NULL,
      @sBeneficiario				CHAR(10)			= NULL,
      
      @bAplica_FormaPago			BIT					= NULL,
      @sFormaPago					CHAR(2)				= NULL,
      
      @bAplica_FechaPago			BIT					= NULL,
      @dFecha_PagoDesde				SMALLDATETIME		= NULL,
      @dFecha_PagoHasta				SMALLDATETIME		= NULL,
      
      @bAplica_Cuenta				BIT					= NULL,
      @sCuenta						CHAR(6)				= NULL,
      
      @bAplica_NumeroDoc			BIT					= NULL,
      @sNumeroDoc					CHAR(20)			= NULL,
      
      @bAplica_Caja					BIT					= NULL,
      @sCaja						CHAR(6)				= NULL,
      
      @bAplica_Cuentaing			BIT					= NULL,
      @sCuentaing					CHAR(20)				= NULL,
      
      @bAplica_Total				BIT					= NULL,
      @dTotal_Desde					decimal(18, 2)		= NULL,
      @dTotal_Hasta					decimal(18, 2)		= NULL,
      
      @bAplica_Sucursal				BIT					= NULL,
	  @sSucursal					CHAR(10)			= NULL,
      
      @bAplica_Nro_Comrpobante		BIT					= NULL,
      @sNro_Comrpobante				INT					= NULL,
     	  
      @iOpcion						INT					= NULL
    )
AS 
    BEGIN	
        DECLARE @SqlString		NVARCHAR(MAX)
        DECLARE @SqlString2		NVARCHAR(MAX)
        DECLARE @operadorLogico CHAR(4)
        
        IF (@bUsaOperadorLogicoAND = 1)
			SET @operadorLogico = ' AND'
		ELSE 
			SET @operadorLogico = ' OR'
			
			
		 SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase
```
