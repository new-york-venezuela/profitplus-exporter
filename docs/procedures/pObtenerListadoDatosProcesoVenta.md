# SP: pObtenerListadoDatosProcesoVenta
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosProcesoVenta]  
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosProcesoVenta]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
      @sField_Name					VARCHAR(30)			= NULL ,
      @sTable_Name					VARCHAR(50)			= NULL ,
      @sValor						VARCHAR(30)			= NULL ,
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      @bAplica_Doc_Pendiente		BIT					= NULL,
      @bDoc_Pendiente				BIT					= NULL,
      @bAplica_Cliente				BIT					= NULL,
      @sCliente						CHAR(16)			= NULL,
      @bAplica_Estatus				BIT					= NULL,
      @sEstatus						CHAR(1)				= NULL,
      @bAplica_Fecha_Emis			BIT					= NULL,
      @dFecha_Emis_Desde			SMALLDATETIME		= NULL,
      @dFecha_Emis_Hasta			SMALLDATETIME		= NULL,
      @bAplica_Fecha_Reg			BIT					= NULL,
      @dFecha_Reg_Desde				SMALLDATETIME		= NULL,
      @dFecha_Reg_Hasta				SMALLDATETIME		= NULL,
      @bAplica_Fecha_Venc			BIT					= NULL,
      @dFecha_Venc_Desde			SMALLDATETIME		= NULL,
      @dFecha_Venc_Hasta			SMALLDATETIME		= NULL,
      @bAplica_Nro_Comrpobante		BIT					= NULL,
      @sNro_Comrpobante				INT					= NULL,
      @bAplica_Nro_Control			BIT					= NULL,
      @sNro_Control				    VARCHAR(20)			= NULL,
	  @bAplica_Sucursal				BIT					= NULL,
	  @sSucursal					CHAR(10)			= NULL,
	  @bAplica_Vendedor				BIT					= NULL,
	  @sVendedor					CHAR(10)			= NULL,
      @iOpcion						INT					= NULL
    )
AS 
    BEGIN     
        DECLARE @SqlString        NVARCHAR(MAX)
        DECLARE @operadorLogico CHAR(4)
        
        IF (@bUsaOperadorLogicoAND = 1)
                     SET @operadorLogico = ' AND'
              ELSE 
                     SET @operadorLogico = ' OR'
                     
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *    
                                     FROM ' + CONVERT(NVARCHAR(100), @sTable_Name) + ' WHERE '
              
              IF (@sValor <> '')
                     BEGIN
                           IF ( @iOpcion = 0 )--Inicia en
                                  BEGIN
```
