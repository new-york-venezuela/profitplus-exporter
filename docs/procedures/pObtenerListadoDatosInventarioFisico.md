# SP: pObtenerListadoDatosInventarioFisico
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatosInventarioFisico]
DESCRIPCION: Obtiene la lista de documentos segun los parametros de entrada
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosInventarioFisico]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,
      
	  @bAplica_Ajuste				BIT					= NULL,
	  @sAjuste						CHAR(20)			= NULL,

	  @bAplica_Almacen				BIT					= NULL,
	  @sAlmacen						CHAR(6)				= NULL,

	  @bAplica_AjusteEntrada		BIT					= NULL,
	  @sAjusteEntrada				CHAR(6)				= NULL,

	  @bAplica_AjusteSalida			BIT					= NULL,
	  @sAjusteSalida				CHAR(6)				= NULL,

      @bAplica_FechaInicio			BIT					= NULL,
      @dFechaInicio_Desde			SMALLDATETIME		= NULL,
      @dFechaInicio_Hasta			SMALLDATETIME		= NULL,

	  @bAplica_FechaProcesado		BIT					= NULL,
      @dFechaProcesado_Desde		SMALLDATETIME		= NULL,
      @dFechaProcesado_Hasta		SMALLDATETIME		= NULL,

	  @bAplica_Estatus				BIT					= NULL,
      @sEstatus						CHAR(1)				= NULL,
	  	  
	  @bAplica_Sucursal				BIT					= NULL,
	  @sSucursal					CHAR(6)				= NULL,          
      
      @iOpcion						INT					= NULL
    )
AS 
    BEGIN	
        DECLARE @SqlString		NVARCHAR(MAX)
        DECLARE @operadorLogico CHAR(4)
		DECLARE @bEstatus BIT
        
        IF (@bUsaOperadorLogicoAND = 1)
			SET @operadorLogico = ' AND'
		ELSE 
			SET @operadorLogico = ' OR'
			
          SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *    
					   FROM ' + CONVERT(NVARCHAR(100), 'saInventarioFisico') + ' WHERE '
		
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
						SET @
```
