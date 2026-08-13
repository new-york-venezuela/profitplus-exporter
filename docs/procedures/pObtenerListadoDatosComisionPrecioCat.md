# SP: pObtenerListadoDatosComisionPrecioCat
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saComisionPrecioCategoria`](../tables/saComisionPrecioCategoria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosComisionPrecioCat]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: Softech Consultores
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosComisionPrecioCat]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,

	  @bAplica_Categoria				BIT					= NULL,
	  @sCategoria					CHAR(30)			= NULL,

	  @bAplica_TipoVendedor			BIT					= NULL,
	  @sTipoVendedor				CHAR(6)				= NULL,

	  @bAplica_TipoPrecio			BIT					= NULL,
	  @sTipoPrecio					CHAR(6)				= NULL,

	  @bAplica_AplicaEn				BIT					= NULL,
	  @sAplicaEn					CHAR(1)				= NULL,

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
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) * FROM saComisionPrecioCategoria
																				 WHERE '
		
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
							+ @sValor + '%'''
					END
			
				IF ( @iOpcion = 3 )--Es Igual
					BEGIN
						SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' = '''
							+ CONVERT(NVARCHAR(30), @sValor) + ''''
					END
			
				IF ( @iOpcion = 4 )--Fonetica
					BEGIN
						SET @SqlString = @SqlString + N' dbo.SoundexBusqueda(' + CONVERT(NVARCHAR(100), @sField_Name) + N','''
							+ CONVERT(NVARCHAR(30), @sValor) + N''') > 3'
					END
```
