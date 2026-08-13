# SP: pObtenerListadoDatosPago
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosPago]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosPago]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
      @sTable_Name					VARCHAR(50)			= NULL ,
      
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
      @bAplica_Anulado				BIT					= NULL,
      @bAnulado						BIT					= NULL,
      
      @bAplica_Recibido				BIT					= NULL,
      @sRecibido					CHAR(15)			= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,
      
      @bAplica_Proveedor			BIT					= NULL,
      @sProveedor					CHAR(16)			= NULL,
      
      @bAplica_Moneda				BIT					= NULL,
      @sMoneda						CHAR(6)				= NULL,
      
      @bAplica_Tipo					BIT					= NULL,
      @sTipo						CHAR(6)				= NULL,
      
      @bAplica_NumeroDoc1			BIT					= NULL,
      @sNumeroDoc1					VARCHAR(20)			= NULL,

	  @bAplica_NumeroControl		BIT					= NULL,
	  @sNumeroControl				VARCHAR(20)			= NULL,
      
      @bAplica_FormaCobro			BIT					= NULL,
      @sFormaCobro					CHAR(2)				= NULL,
      
      @bAplica_NumeroDoc2			BIT					= NULL,
      @sNumeroDoc2					VARCHAR(20)			= NULL,
      
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
        DECLARE @operadorLogico CHAR(4)
        
        IF (@bUsaOperadorLogicoAND = 1)
			SET @operadorLogico = ' AND'
		ELSE 
			SET @operadorLogico = ' OR'
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *    
					   FROM ' + CONVERT(NVARCHAR(100), @sTable_Name) + 
					   ' IN
```
