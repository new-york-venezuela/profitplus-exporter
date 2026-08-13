# SP: pObtenerListadoDatosArtCrearAut
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saArtCrearAut`](../tables/saArtCrearAut.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosArtCrearAut]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosArtCrearAut]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
	  @bAplica_Fecha				BIT					= NULL,
	  @dtFecha_Desde				SMALLDATETIME		= NULL,
	  @dtFecha_Hasta				SMALLDATETIME		= NULL,

	  @bAplica_Utiliza_Lote			BIT					= NULL,
	  @sUtiliza_Lote				CHAR(1)				= NULL,

	  @bAplica_Utiliza_Serial		BIT					= NULL,
	  @sUtiliza_Serial				CHAR(1)				= NULL,

	  @bAplica_Tipo_Doc				BIT					= NULL,
	  @sTipo_Doc					CHAR(1)				= NULL,

	  @bAplica_Linea				BIT					= NULL,
	  @sLinea						CHAR(6)				= NULL,

	  @bAplica_Sublinea				BIT					= NULL,
	  @sSublinea					CHAR(6)				= NULL,

	  @bAplica_Categoria			BIT					= NULL,
	  @sCategoria					CHAR(6)				= NULL,

	  @bAplica_Color				BIT					= NULL,
	  @sColor						CHAR(6)				= NULL,

	  @bAplica_Ubicacion			BIT					= NULL,
	  @sUbicacion					CHAR(6)				= NULL,

	  @bAplica_Procedencia			BIT					= NULL,
	  @sProcedencia					CHAR(6)				= NULL,

	  @bAplica_Procesado			BIT					= NULL,
	  @sProcesado					CHAR(1)				= NULL,
     	  
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
					   FROM ' + CONVERT(NVARCHAR(100), 'saArtCrearAut') + ' WHERE '
		
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
							+ CONVERT(NVAR
```
