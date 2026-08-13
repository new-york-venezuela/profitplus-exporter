# SP: pObtenerListadoDatosArticulo
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosArticulo]
DESCRIPCION: Obtiene la lista de articulos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosArticulo]
    (
      @sDatabase_Name				VARCHAR(30) = NULL ,
     
      @sField_Name					VARCHAR(30) = NULL ,
      @sValor						VARCHAR(30) = NULL ,
       
      @bAvanzada					BIT			= NULL,
      @bUsaOperadorLogicoAND		BIT			= NULL,
      
      @bAplica_EsInactivo			BIT			= NULL,
      @sEsInactivo					CHAR(1)		= NULL,
      
      @bAplica_Manejo_Lote			BIT			= NULL,
      @sManeja_Lote					CHAR(1)		= NULL,
      
      @bAplica_Manejo_Serial		BIT			= NULL,
      @sManeja_Serial				CHAR(1)		= NULL,
      
      @bAplica_Tipo					BIT			= NULL,
	  @sTipo						CHAR(1)		= NULL,	
	  
	  @bAplica_Co_Lin				BIT			= NULL,
      @sCo_Lin						CHAR(6)		= NULL,
      
      @bAplica_Co_Subl				BIT			= NULL,
      @sCo_Subl						CHAR(6)		= NULL,
      
      @bAplica_Co_Cat				BIT			= NULL,
      @sCo_Cat						CHAR(6)		= NULL,
      
      @bAplica_Co_Color				BIT			= NULL,
      @sCo_Color					CHAR(6)		= NULL,
      
      @bAplica_Co_Proc				BIT			= NULL,
      @sCo_Proc						CHAR(6)		= NULL,
      
	  @bAplica_Co_Ubicacion			BIT			= NULL,
      @sCo_Ubicacion				CHAR(6)		= NULL,
      
      @bAplica_Item					BIT			= NULL,
      @sItem						CHAR(10)	= NULL,
      
      @bAplica_Ref					BIT			= NULL,
      @sRef							VARCHAR(20)	= NULL,
      
      @iOpcion						INT			= NULL
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
					   FROM ' + CONVERT(NVARCHAR(100), 'saArticulo') + ' WHERE '
		
		IF (@sValor <> '')
			BEGIN
				IF ( @iOpcion = 0 )--Inicia en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE '''
							+ CONVERT(NVARCHAR(30), @sValor) + '%'''
					END

				IF ( @iOpcion = 1 )--Termina en
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVAR
```
