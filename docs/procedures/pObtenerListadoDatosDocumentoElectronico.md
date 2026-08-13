# SP: pObtenerListadoDatosDocumentoElectronico
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosDocumentoElectronico]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosDocumentoElectronico]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL,
      @sField_Name					VARCHAR(30)			= NULL,
      @sValor						VARCHAR(30)			= NULL,
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
	  @sTipo_Documento				CHAR(10)			,
      @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,
	  @bAplica_Co_Grupo_Rep			BIT					= NULL,
	  @sCo_Grupo_Rep				CHAR(6)			= NULL,
	  @bAplica_Co_Reporte			BIT					= NULL,
	  @sCo_Reporte					CHAR(6)				= NULL,
	  @bAplica_Estatus				BIT					= NULL,
	  @sEstatus						CHAR(1)				= NULL,          
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
					   FROM ' + CONVERT(NVARCHAR(100), '(SELECT * FROM saDocumentoElectronico WHERE tipo_documento = ''' + @sTipo_Documento + ''') AS saDocumentoElectronico') + ' WHERE '
		
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
```
