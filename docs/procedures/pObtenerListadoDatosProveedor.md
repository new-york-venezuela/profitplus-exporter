# SP: pObtenerListadoDatosProveedor
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosProveedor]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosProveedor]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
      @bAplica_Inactivo				BIT					= NULL,
      @bInactivo					BIT					= NULL,
      
      @bAplica_Nacional				BIT					= NULL,
      @bNacional					BIT					= NULL,
      
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,
      
      @bAplica_Tipo					BIT					= NULL,
      @sTipo						CHAR(6)				= NULL,
      
      @bAplica_RIF					BIT					= NULL,
      @sRIF							VARCHAR(18)			= NULL,
      
      @bAplica_Zona					BIT					= NULL,
      @sTipo_Zona					CHAR(6)				= NULL,
      
      @bAplica_Segmento				BIT					= NULL,
      @sSegmento					CHAR(6)				= NULL,
      
      @bAplica_Cta_ing				BIT					= NULL,
      @sCta_ing						CHAR(20)			= NULL,
     	  
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
					   FROM ' + CONVERT(NVARCHAR(100), 'saProveedor') + ' WHERE '
		
		IF (@sValor <> '')
			BEGIN
				IF ( @iOpcion = 0 )--Inicia en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE '''
							+ CONVERT(NVARCHAR(30), @sValor) + '%'''
					END

				IF ( @iOpcion = 1 )--Termina en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
							+ CONVERT(NVARCHAR(30), @sValor) + ''''
					END

				IF ( @iOpcion = 2 )--Contiene
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
							+ @sValo
```
