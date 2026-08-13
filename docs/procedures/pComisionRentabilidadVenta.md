# SP: pComisionRentabilidadVenta
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)
- [`saComisionResultado`](../tables/saComisionResultado.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pComisionRentabilidad
*AUTOR			:		SOFTECH SISTEMAS.
*DESCRIPCIÓN	:		Calculo de comisiones de Rentabilidad
************************************************************************************************/

CREATE PROCEDURE [pComisionRentabilidadVenta]
    (
      @dtFecha_d DATETIME = NULL ,
      @dtFecha_h DATETIME = NULL ,
      @strCo_Ven_d CHAR(6) = NULL ,
      @strCo_Ven_h CHAR(6) = NULL ,
      @strTipo_Ven_d CHAR(4) = NULL ,
      @strTipo_Ven_h CHAR(4) = NULL ,
      @strTipoRen CHAR(6) = NULL, -- A: articulo, L: Linea, C: Categoria
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

        IF @strTipoRen = 'REVART' 
            SET @strCo_Tipo_comi = 'REVART'
        ELSE 
            IF @strTipoRen = 'REVLIN' 
                SET @strCo_Tipo_comi = 'REVLIN'
            ELSE 
                IF @strTipoRen = 'REVCAT' 
                    SET @strCo_Tipo_comi = 'REVCAT'
                ELSE 
                    BEGIN
                        SET @MensajeError = 'El tipo de comisión "' + RTRIM(@strTipoRen) + '" no es válido. Use REVART, REVLIN o REVCAT.'
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
                    + RTRIM(@strCo_Tipo_comi)
```
