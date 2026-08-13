# SP: pObtenerListadoDatosAjustePrecioCostoManual
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoM`](../tables/saAjPrecioCostoM.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:		 [pObtenerListadoDatosAjustePrecioCostoManual]
DESCRIPCION: Obtiene la lista de los registros de ajustes manuales de precios y/o costos dado un rango de 
			 fechas, el estatus del ajuste (procesado o no), el almacén donde fue realizado y el tipo de ajuste 
			 (de precio o de costo).
CREADO POR:  Softech Consultores
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListadoDatosAjustePrecioCostoManual]
    (
      @sDatabase_Name				VARCHAR(30)			= NULL ,
     
      @sField_Name					VARCHAR(30)			= NULL ,
   
      @sValor						VARCHAR(30)			= NULL ,
       
      @bAvanzada					BIT					= NULL,
      @bUsaOperadorLogicoAND		BIT					= NULL,     
	  
	  @bAplica_Fecha				BIT					= NULL,
      @dFecha_Desde					SMALLDATETIME		= NULL,
      @dFecha_Hasta					SMALLDATETIME		= NULL,

	  @bAplica_Estatus				BIT					= NULL,
	  @bEstatus						BIT					= NULL,
      
      @bAplica_Almacen				BIT					= NULL,
      @sAlmacen						CHAR(6)				= NULL,
	  
	  @bAplica_TipoAjuste			BIT					= NULL,
	  @sTipoAjuste					CHAR(1)				= NULL,      
      
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
					   FROM ' + CONVERT(NVARCHAR(100), 'saAjPrecioCostoM') + ' WHERE '
		
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
							+ CO
```
