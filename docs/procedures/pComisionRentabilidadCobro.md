# SP: pComisionRentabilidadCobro
**Tipo**: Procedimiento
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)
- [`saComisionResultado`](../tables/saComisionResultado.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pComisionRentabilidadCobro
*AUTOR			:		SOFTECH SISTEMAS.
*LAST UPDATE    :       <2019-05-17>
*DESCRIPCIÓN	:		Calculo de comisiones de Rentabilidad
************************************************************************************************/
CREATE PROCEDURE [dbo].[pComisionRentabilidadCobro]
    (
      @dtFecha_d AS DATETIME = NULL ,
      @dtFecha_h AS DATETIME = NULL ,
      @strCo_Ven_d AS CHAR(6) = NULL ,
      @strCo_Ven_h AS CHAR(6) = NULL ,
      @strTipo_Ven_d AS CHAR(4) = NULL ,
      @strTipo_Ven_h AS CHAR(4) = NULL ,
      @strTipoRen AS CHAR(6) = NULL, -- A: articulo, L: Linea, C: Categoria
      @strSucursal AS CHAR(6) = NULL
    )
AS 
    BEGIN

        DECLARE @strCo_Tipo_comi CHAR(6)
        DECLARE @margenPrecioCosto BIT
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @dtActual AS DATETIME
        DECLARE @deResultComi DECIMAL(18, 2)
        SET @dtActual = GETDATE()

        SELECT  @margenPrecioCosto = c_margen_costo_precio
        FROM    par_emp

        
        IF @strTipoRen IS NULL
           SET @strTipoRen = '' 
           
        IF @strTipoRen = 'RECART' 
            SET @strCo_Tipo_comi = 'RECART'
        ELSE 
            IF @strTipoRen = 'RECLIN' 
                SET @strCo_Tipo_comi = 'RECLIN'
            ELSE 
                IF @strTipoRen = 'RECCAT' 
                    SET @strCo_Tipo_comi = 'RECCAT'
                ELSE 
                    BEGIN
						SET @MensajeError = 'El tipo de comisión "' + RTRIM(@strTipoRen) + '" no es válido. Use RECART, RECLIN o RECCAT.'
                        RAISERROR(@MensajeError,16,1)
                        RETURN ;
                    END

        IF ( @dtFecha_d IS NULL ) 
            BEGIN
                SET @MensajeError = 'La fecha desde no puede ser nula.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END

        IF ( @dtFecha_h IS NULL ) 
            BEGIN
                SET @MensajeError = 'La fecha hasta no puede ser nula.'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END

        IF ( dbo.existsComisionGenerada(@strCo_Tipo_comi, @dtFecha_d,
                                        @dtFecha_h) IS NOT NULL ) 
            BEGIN
                SET @MensajeError = 'Ya existe una generación de comisión del tipo "'
```
