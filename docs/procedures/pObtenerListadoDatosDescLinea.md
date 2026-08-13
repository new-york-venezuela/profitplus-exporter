# SP: pObtenerListadoDatosDescLinea
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saDescLinea`](../tables/saDescLinea.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosDescLinea]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: Softech Consultores
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosDescLinea]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,

	  @bAplica_Fecha_Desde			BIT					= NULL,
	  @dtFecha_Desde_Ini			DATETIME			= NULL,
	  @dtFecha_Desde_Fin			DATETIME			= NULL,

	  @bAplica_Fecha_Hasta			BIT					= NULL,
	  @dtFecha_Hasta_Ini			DATETIME			= NULL,
	  @dtFecha_Hasta_Fin			DATETIME			= NULL,

	  @bAplica_Linea				BIT					= NULL,
	  @sLinea						CHAR(6)				= NULL,

	  @bAplica_Tipo_Cliente			BIT					= NULL,
	  @sTipo_Cliente				CHAR(6)				= NULL,
      
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
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) * FROM saDescLinea WHERE '
		
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
							+ CONVE
```
